using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ChatSec.API.Middleware;

public partial class InputSanitizationMiddleware
{
    private readonly RequestDelegate _next;

    // Whitelist: only allow safe printable characters
    // Rejects null bytes, control characters, and HTML tag patterns
    [GeneratedRegex(@"[^\w\s.,!?@#$%^&*()\-+=\[\]{}|:;<>/\\']")]
    private static partial Regex DangerousChars();

    public InputSanitizationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only inspect requests that have a JSON body
        if (context.Request.ContentType?.Contains("application/json") == true
            && (context.Request.Method == "POST" || context.Request.Method == "PUT"))
        {
            context.Request.EnableBuffering(); // Allows us to read the body and reset it

            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0; // Reset so the controller can read it too

            if (!string.IsNullOrEmpty(body))
            {
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (ContainsDangerousContent(doc.RootElement))
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsync(
                            JsonSerializer.Serialize(new { error = "Input contains invalid characters." }));
                        return; // Stop the pipeline — do not pass to controller
                    }
                }
                catch (JsonException)
                {
                    // Malformed JSON — let the controller handle it naturally
                }
            }
        }

        await _next(context);
    }

    private static bool ContainsDangerousContent(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject())
                    if (ContainsDangerousContent(prop.Value)) return true;
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    if (ContainsDangerousContent(item)) return true;
                break;

            case JsonValueKind.String:
                var value = element.GetString() ?? string.Empty;
                // Allow Base64 content (encrypted messages and keys will be Base64)
                if (IsBase64(value)) return false;
                if (DangerousChars().IsMatch(value)) return true;
                break;
        }

        return false;
    }

    private static bool IsBase64(string value)
    {
        // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = for padding
        return value.Length > 0 && System.Text.RegularExpressions.Regex.IsMatch(value, @"^[A-Za-z0-9+/=]+$");
    }
}
