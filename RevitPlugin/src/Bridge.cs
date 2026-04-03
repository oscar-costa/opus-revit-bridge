using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Autodesk.Revit.UI;
using RevitOpusBridge.Handlers;

namespace RevitOpusBridge
{
    public sealed class Bridge : IDisposable
    {
        private const string PipeName = "opus-revit-bridge";

        private readonly DispatcherEventHandler _dispatcher;
        private readonly ExternalEvent _externalEvent;
        private readonly GetProjectInfoHandler _getProjectInfoHandler = new();
        private readonly GetWallsHandler _getWallsHandler = new();
        private readonly GetRoomsHandler _getRoomsHandler = new();
        private readonly GetElementsByCategoryHandler _getElementsByCategoryHandler = new();

        private CancellationTokenSource? _cts;
        private Task? _listenTask;

        public Bridge()
        {
            _dispatcher = new DispatcherEventHandler();
            _externalEvent = ExternalEvent.Create(_dispatcher);
        }

        public void Start()
        {
            _cts = new CancellationTokenSource();
            _listenTask = Task.Run(() => ListenLoop(_cts.Token));
        }

        public void Stop()
        {
            _cts?.Cancel();
            try { _listenTask?.Wait(TimeSpan.FromSeconds(3)); } catch { }
            _externalEvent.Dispose();
        }

        private async Task ListenLoop(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    using var pipe = new NamedPipeServerStream(
                        PipeName,
                        PipeDirection.InOut,
                        1,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous);

                    await pipe.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);

                    using var reader = new StreamReader(
                        pipe,
                        new UTF8Encoding(false),
                        false,
                        4096,
                        true);
                    using var writer = new StreamWriter(
                        pipe,
                        new UTF8Encoding(false),
                        4096,
                        true)
                    {
                        AutoFlush = true,
                    };

                    string? line;
                    while ((line = await reader.ReadLineAsync().ConfigureAwait(false)) != null
                        && !cancellationToken.IsCancellationRequested)
                    {
                        string response = await HandleRequest(line).ConfigureAwait(false);
                        await writer.WriteLineAsync(response).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RevitOpusBridge] Bridge error: {ex.Message}");
                    await Task.Delay(500, cancellationToken).ConfigureAwait(false);
                }
            }
        }

        private async Task<string> HandleRequest(string requestJson)
        {
            try
            {
                using var document = JsonDocument.Parse(requestJson);
                string? method = document.RootElement.GetProperty("method").GetString();

                return method switch
                {
                    "get_project_info" => await DispatchAndWait(
                        app => _getProjectInfoHandler.Execute(app)).ConfigureAwait(false),
                    "get_walls" => await DispatchAndWait(
                        app => _getWallsHandler.Execute(app)).ConfigureAwait(false),
                    "get_rooms" => await DispatchAndWait(
                        app => _getRoomsHandler.Execute(app)).ConfigureAwait(false),
                    "get_elements_by_category" => await DispatchAndWait(app =>
                        _getElementsByCategoryHandler.Execute(
                            app,
                            document.RootElement
                                .GetProperty("params")
                                .GetProperty("category")
                                .GetString() ?? string.Empty)).ConfigureAwait(false),
                    _ => ErrorResponse($"Unknown method: {method}"),
                };
            }
            catch (Exception ex)
            {
                return ErrorResponse(ex.Message);
            }
        }

        private Task<string> DispatchAndWait(Func<UIApplication, string> action)
        {
            var tcs = new TaskCompletionSource<string>(
                TaskCreationOptions.RunContinuationsAsynchronously);

            _dispatcher.Enqueue(action, tcs);

            var request = _externalEvent.Raise();
            if (request == ExternalEventRequest.Denied)
            {
                tcs.TrySetException(new InvalidOperationException(
                    "Revit rejected the ExternalEvent. Close modal dialogs and try again."));
                return tcs.Task;
            }

            var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            timeout.Token.Register(() =>
                tcs.TrySetException(new TimeoutException(
                    "Revit ExternalEvent did not execute within 30 seconds.")));

            return tcs.Task;
        }

        private static string ErrorResponse(string message)
        {
            return JsonSerializer.Serialize(new { result = (object?)null, error = message });
        }

        public void Dispose()
        {
            Stop();
        }
    }
}
