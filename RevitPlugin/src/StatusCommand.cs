using Autodesk.Revit.Attributes;
using Autodesk.Revit.UI;

namespace RevitOpusBridge
{
    [Transaction(TransactionMode.Manual)]
    public class StatusCommand : IExternalCommand
    {
        public Result Execute(
            ExternalCommandData commandData,
            ref string message,
            Autodesk.Revit.DB.ElementSet elements)
        {
            TaskDialog.Show(
                "Opus Revit Bridge",
                "Bridge status: active\nPipe: \\.\\pipe\\opus-revit-bridge\n\nAvailable methods:\n- get_project_info\n- get_walls\n- get_rooms\n- get_elements_by_category");
            return Result.Succeeded;
        }
    }
}
