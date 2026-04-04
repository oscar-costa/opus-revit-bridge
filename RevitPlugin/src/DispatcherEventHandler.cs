using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Autodesk.Revit.UI;

namespace RevitOpusBridge
{
    internal sealed class DispatcherEventHandler : IExternalEventHandler
    {
        private readonly ConcurrentQueue<DispatchWorkItem> _pendingItems = new();

        private sealed class DispatchWorkItem
        {
            public DispatchWorkItem(Func<UIApplication, string> action, TaskCompletionSource<string> completionSource)
            {
                Action = action;
                CompletionSource = completionSource;
            }

            public Func<UIApplication, string> Action { get; }

            public TaskCompletionSource<string> CompletionSource { get; }
        }

        public void Enqueue(Func<UIApplication, string> action, TaskCompletionSource<string> tcs)
        {
            _pendingItems.Enqueue(new DispatchWorkItem(action, tcs));
        }

        public void Execute(UIApplication app)
        {
            while (_pendingItems.TryDequeue(out var workItem))
            {
                try
                {
                    workItem.CompletionSource.TrySetResult(workItem.Action(app));
                }
                catch (Exception ex)
                {
                    workItem.CompletionSource.TrySetException(ex);
                }
            }
        }

        public string GetName() => "RevitOpusBridge.Dispatcher";
    }
}
