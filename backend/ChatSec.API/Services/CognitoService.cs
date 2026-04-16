using System.Security.Cryptography;
using System.Text;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;

namespace ChatSec.API.Services;

public class CognitoService
{
    private readonly IAmazonCognitoIdentityProvider _cognito;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _userPoolId;

    public CognitoService(IAmazonCognitoIdentityProvider cognito, IConfiguration config)
    {
        _cognito      = cognito;
        _clientId     = config["AWS:CognitoClientId"]     ?? throw new InvalidOperationException("AWS:CognitoClientId is not configured.");
        _clientSecret = config["AWS:CognitoClientSecret"] ?? throw new InvalidOperationException("AWS:CognitoClientSecret is not configured.");
        _userPoolId   = config["AWS:CognitoPoolId"]       ?? throw new InvalidOperationException("AWS:CognitoPoolId is not configured.");
    }

    // Creates a new user in Cognito. Returns the Cognito sub (UUID) which becomes our userId.
    // The email is used as the Cognito username because the pool has username_attributes = ["email"].
    public async Task<string> SignUpAsync(string email, string password)
    {
        var response = await _cognito.SignUpAsync(new SignUpRequest
        {
            ClientId   = _clientId,
            SecretHash = ComputeSecretHash(email),
            Username   = email,
            Password   = password
        });

        return response.UserSub; // The Cognito-assigned UUID — this becomes our userId
    }

    // Auto-confirms the user so they can log in immediately without email verification.
    // Requires cognito-idp:AdminConfirmSignUp IAM permission on the ECS task role.
    public async Task AdminConfirmSignUpAsync(string email)
    {
        await _cognito.AdminConfirmSignUpAsync(new AdminConfirmSignUpRequest
        {
            UserPoolId = _userPoolId,
            Username   = email
        });
    }

    // Verifies the password against Cognito and returns the Access Token (a signed JWT).
    // The Access Token is what we store in the auth_token cookie.
    public async Task<string> InitiateAuthAsync(string email, string password)
    {
        var response = await _cognito.InitiateAuthAsync(new InitiateAuthRequest
        {
            AuthFlow = AuthFlowType.USER_PASSWORD_AUTH,
            ClientId = _clientId,
            AuthParameters = new Dictionary<string, string>
            {
                ["USERNAME"]   = email,
                ["PASSWORD"]   = password,
                ["SECRET_HASH"] = ComputeSecretHash(email)
            }
        });

        return response.AuthenticationResult.AccessToken;
    }

    // SecretHash = Base64( HMAC-SHA256( email + clientId, clientSecret ) )
    // Required for every Cognito API call when the app client has a secret.
    private string ComputeSecretHash(string email)
    {
        var message = Encoding.UTF8.GetBytes(email + _clientId);
        var key     = Encoding.UTF8.GetBytes(_clientSecret);

        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(message);
        return Convert.ToBase64String(hash);
    }
}
