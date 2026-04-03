using System;
using System.Text.Json;
using Autodesk.Revit.UI;

namespace RevitOpusBridge.Handlers
{
    internal sealed class GetProjectInfoHandler
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

                var info = document.ProjectInformation;
                return JsonSerializer.Serialize(new
                {
                    result = new
                    {
                        name = info.Name,
                        address = info.Address,
                        clientName = info.ClientName,
                        projectNumber = info.Number,
                    },
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
