# Stage 1 — Build
FROM --platform=linux/arm64 mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files first (better layer caching)
COPY backend/ChatSec.slnx ./
COPY backend/ChatSec.API/ChatSec.API.csproj ./ChatSec.API/

# Restore NuGet packages (cached unless .csproj changes)
RUN dotnet restore ./ChatSec.API/ChatSec.API.csproj

# Copy the rest of the source code
COPY backend/ChatSec.API/ ./ChatSec.API/

# Build and publish release binaries
RUN dotnet publish ./ChatSec.API/ChatSec.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# Stage 2 — Runtime
FROM --platform=linux/arm64 mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy only the published output from the build stage
COPY --from=build /app/publish .

# ASP.NET Core listens on 8080 by default in .NET 10
EXPOSE 8080

ENTRYPOINT ["dotnet", "ChatSec.API.dll"]
