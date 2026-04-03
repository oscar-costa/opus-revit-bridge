using Autodesk.Revit.DB;
using System;
using System.Globalization;
using System.Reflection;

namespace RevitOpusBridge
{
    internal static class RevitApiCompatibility
    {
    private static readonly PropertyInfo? ElementIdValueProperty = typeof(ElementId).GetProperty("Value");
    private static readonly PropertyInfo? ElementIdIntegerValueProperty = typeof(ElementId).GetProperty("IntegerValue");

        public static double ConvertAreaToSquareMeters(double internalArea)
        {
#if REVIT2020
            return UnitUtils.ConvertFromInternalUnits(internalArea, DisplayUnitType.DUT_SQUARE_METERS);
#else
            return UnitUtils.ConvertFromInternalUnits(internalArea, UnitTypeId.SquareMeters);
#endif
        }

        public static double ConvertLengthToMeters(double internalLength)
        {
#if REVIT2020
            return UnitUtils.ConvertFromInternalUnits(internalLength, DisplayUnitType.DUT_METERS);
#else
            return UnitUtils.ConvertFromInternalUnits(internalLength, UnitTypeId.Meters);
#endif
        }

        public static long GetElementIdValue(ElementId elementId)
        {
            if (ElementIdValueProperty?.GetValue(elementId) is object value)
            {
                return Convert.ToInt64(value, CultureInfo.InvariantCulture);
            }

            if (ElementIdIntegerValueProperty?.GetValue(elementId) is object integerValue)
            {
                return Convert.ToInt64(integerValue, CultureInfo.InvariantCulture);
            }

            throw new InvalidOperationException("Could not resolve a numeric value from Autodesk.Revit.DB.ElementId.");
        }
    }
}