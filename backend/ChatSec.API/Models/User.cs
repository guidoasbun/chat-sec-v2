namespace ChatSec.API.Models;

public class User
{
    public string UserId { get; set; } = string.Empty;    // Cognito sub (UUID) — primary key
    public string Username { get; set; } = string.Empty;  // Unique display name
    public string Email { get; set; } = string.Empty;      // Cognito login identifier (email is the Cognito username)
    public string PublicKey { get; set; } = string.Empty; // RSA-4096 public key in PEM format
    public string SigningPublicKey { get; set; } = string.Empty; // RSA-PSS signing key PEM
    public string CreatedAt { get; set; } = string.Empty; // ISO 8601 timestamp
}
