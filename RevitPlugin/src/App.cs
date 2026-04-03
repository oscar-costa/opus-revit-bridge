using System.Reflection;
using System.Windows;
using System.Windows.Media;
using Autodesk.Revit.UI;

namespace RevitOpusBridge
{
    public class App : IExternalApplication
    {
        private Bridge? _bridge;

        public Result OnStartup(UIControlledApplication application)
        {
            _bridge = new Bridge();
            _bridge.Start();
            AddStatusPanel(application);
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            _bridge?.Stop();
            _bridge = null;
            return Result.Succeeded;
        }

        private static void AddStatusPanel(UIControlledApplication application)
        {
            try { application.CreateRibbonTab("Opus Bridge"); }
            catch { }

            var panel = application.CreateRibbonPanel("Opus Bridge", "Status");
            string assemblyPath = Assembly.GetExecutingAssembly().Location;

            var buttonData = new PushButtonData(
                "opusBridgeStatus",
                "Opus\nBridge",
                assemblyPath,
                typeof(StatusCommand).FullName);

            buttonData.Image = CreateBlueDot(16);
            buttonData.LargeImage = CreateBlueDot(32);
            buttonData.ToolTip = "The Opus Revit Bridge add-in is running.";
            buttonData.AvailabilityClassName = typeof(AlwaysAvailability).FullName;

            panel.AddItem(buttonData);
        }

        private static ImageSource CreateBlueDot(int size)
        {
            double center = size / 2.0;
            double radius = center - 1.5;

            var geometry = new EllipseGeometry(new Point(center, center), radius, radius);
            var drawing = new GeometryDrawing(
                new SolidColorBrush(Color.FromRgb(0x16, 0x68, 0xA8)),
                new Pen(new SolidColorBrush(Color.FromRgb(0x0E, 0x47, 0x72)), 1.5),
                geometry);

            var image = new DrawingImage(drawing);
            image.Freeze();
            return image;
        }
    }
}
