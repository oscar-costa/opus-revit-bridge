using System;
using System.Threading.Tasks;
using Autodesk.Revit.UI;

namespace RevitOpusBridge
{
    internal sealed class DispatcherEventHandler : IExternalEventHandler
    {
        private Func<UIApplication, string>? _pendingAction;
        private TaskCompletionSource<string>? _tcs;

        public void Enqueue(Func<UIApplication, string> action, TaskCompletionSource<string> tcs)
        {
            _pendingAction = action;
            _tcs = tcs;
        }

        public void Execute(UIApplication app)
        {
            var action = _pendingAction;
            var tcs = _tcs;

            _pendingAction = null;
            _tcs = null;

            if (action == null || tcs == null)
            {
                return;
            }

            try
            {
                tcs.TrySetResult(action(app));
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }
        }

        public string GetName() => "RevitOpusBridge.Dispatcher";
    }
}
