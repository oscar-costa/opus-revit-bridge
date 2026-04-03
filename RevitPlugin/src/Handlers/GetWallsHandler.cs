using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitOpusBridge.Handlers
{
    internal sealed class GetWallsHandler
    {
        public string Execute(UIApplication app)
        {
            try
            {
                var document = app.ActiveUIDocument?.Document;
                if (document == null)
                {
                    return JsonSerializer.Serialize(new
                    {
                        result = (object?)null,
                        error = "No active Revit document is open.",
                    });
                }

                var walls = new FilteredElementCollector(document)
                    .OfClass(typeof(Wall))
                    .Cast<Wall>();

                var wallList = new List<object>();
                foreach (var wall in walls)
                {
                    var lengthParameter = wall.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH);
                    var lengthMeters = lengthParameter != null
                        ? RevitApiCompatibility.ConvertLengthToMeters(lengthParameter.AsDouble())
                        : 0.0;

                    var baseLevelId = wall.get_Parameter(BuiltInParameter.WALL_BASE_CONSTRAINT)?.AsElementId();
                    var baseLevel = baseLevelId != null && baseLevelId != ElementId.InvalidElementId
                        ? document.GetElement(baseLevelId)?.Name ?? "Unknown"
                        : "Unknown";

                    var topConstraintId = wall.get_Parameter(BuiltInParameter.WALL_HEIGHT_TYPE)?.AsElementId();
                    var topConstraint = topConstraintId != null && topConstraintId != ElementId.InvalidElementId
                        ? document.GetElement(topConstraintId)?.Name ?? "Unconnected"
                        : "Unconnected";

                    wallList.Add(new
                    {
                        id = RevitApiCompatibility.GetElementIdValue(wall.Id),
                        typeName = wall.WallType.Name,
                        length = lengthMeters,
                        baseLevel,
                        topConstraint,
                    });
                }

                return JsonSerializer.Serialize(new
                {
                    result = new { walls = wallList },
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
