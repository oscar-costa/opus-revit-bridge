using System;
using System.Collections.Generic;
using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitOpusBridge.Handlers
{
    internal sealed class GetElementsByCategoryHandler
    {
        public string Execute(UIApplication app, string categoryName)
        {
            try
            {
                if (!Enum.TryParse<BuiltInCategory>(categoryName, out var builtInCategory))
                {
                    return JsonSerializer.Serialize(new
                    {
                        result = (object?)null,
                        error = $"Unknown BuiltInCategory: '{categoryName}'.",
                    });
                }

                var document = app.ActiveUIDocument?.Document;
                if (document == null)
                {
                    return JsonSerializer.Serialize(new
                    {
                        result = (object?)null,
                        error = "No active Revit document is open.",
                    });
                }

                var collector = new FilteredElementCollector(document)
                    .OfCategory(builtInCategory)
                    .WhereElementIsNotElementType();

                var elementList = new List<object>();
                foreach (var element in collector)
                {
                    var typeName = string.Empty;
                    if (element.GetTypeId() is ElementId typeId
                        && typeId != ElementId.InvalidElementId
                        && document.GetElement(typeId) is ElementType elementType)
                    {
                        typeName = elementType.Name;
                    }

                    var levelName = "Unknown";
                    if (element is FamilyInstance familyInstance
                        && familyInstance.LevelId != ElementId.InvalidElementId)
                    {
                        levelName = document.GetElement(familyInstance.LevelId)?.Name ?? "Unknown";
                    }

                    elementList.Add(new
                    {
                        id = RevitApiCompatibility.GetElementIdValue(element.Id),
                        name = element.Name,
                        typeName,
                        level = levelName,
                    });
                }

                return JsonSerializer.Serialize(new
                {
                    result = new { category = categoryName, elements = elementList },
                    error = (string?)null,
                });
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new
                {
                    result = (object?)null,
                    error = ex.Message,
                });
            }
        }
    }
}
