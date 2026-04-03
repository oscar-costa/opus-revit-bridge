using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitOpusBridge
{
    public class AlwaysAvailability : IExternalCommandAvailability
    {
        public bool IsCommandAvailable(UIApplication applicationData, CategorySet selectedCategories)
        {
            return true;
        }
    }
}
