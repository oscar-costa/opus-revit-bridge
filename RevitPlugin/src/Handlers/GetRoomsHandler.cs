using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.UI;

namespace RevitOpusBridge.Handlers
{
    internal sealed class GetRoomsHandler
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

                var rooms = new FilteredElementCollector(document)
                    .OfClass(typeof(SpatialElement))
                    .OfCategory(BuiltInCategory.OST_Rooms)
                    .Cast<Room>();

                var roomList = new List<object>();
                foreach (var room in rooms)
                {
                    if (room.Area <= 0)
                    {
                        continue;
                    }

                    var areaSquareMeters = UnitUtils.ConvertFromInternalUnits(
                        room.Area,
                        UnitTypeId.SquareMeters);

                    roomList.Add(new
                    {
                        id = room.Id.Value,
                        name = room.Name,
                        number = room.Number,
                        area = areaSquareMeters,
                        level = room.Level?.Name ?? "Unknown",
                    });
                }

                return JsonSerializer.Serialize(new
                {
                    result = new { rooms = roomList },
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
