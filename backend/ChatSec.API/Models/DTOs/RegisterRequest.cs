namespace ChatSec.API.Models.DTOs;

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;  // Chosen display name
    public string Password { get; set; } = string.Empty;  // Sent to Cognito — never stored by us
    public string Email { get; set; } = string.Empty;     // Required by Cognito user pool
    public string PublicKey { get; set; } = string.Empty; // RSA-4096 PEM — generated in browser, stored in DynamoDB
}
