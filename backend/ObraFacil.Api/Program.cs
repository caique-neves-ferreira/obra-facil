using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ObraFacil.Api.Data;
using ObraFacil.Api.Endpoints;
using ObraFacil.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------- Banco de dados ----------
// Produção (Render/Neon): variável DATABASE_URL no formato postgres://user:pass@host/db
// Desenvolvimento local: cai para SQLite automaticamente.
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (!string.IsNullOrEmpty(databaseUrl))
        options.UseNpgsql(ConverterDatabaseUrl(databaseUrl));
    else
        options.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=obrafacil.db");
});

// ---------- Autenticação JWT ----------
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "dev-secret-troque-em-producao-0123456789";
builder.Configuration["Jwt:Secret"] = jwtSecret;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = "obrafacil-api",
            ValidAudience = "obrafacil-api",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient<AnaliseIaService>();

// ---------- CORS ----------
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL");
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (!string.IsNullOrEmpty(frontendUrl))
            policy.WithOrigins(frontendUrl.Split(',', StringSplitOptions.TrimEntries));
        else
            policy.AllowAnyOrigin(); // dev / MVP

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Render define a porta via variável PORT
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

// Cria o schema automaticamente no primeiro start (MVP).
// Próximo passo recomendado: migrar para dotnet ef migrations.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    servico = "Obra Fácil API",
    status = "online",
    docs = "/swagger"
}));

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapAuthEndpoints();
app.MapProjetoEndpoints();
app.MapAnaliseEndpoints();

app.Run();

// Converte postgres://user:pass@host:port/db para connection string do Npgsql
static string ConverterDatabaseUrl(string url)
{
    var uri = new Uri(url);
    var userInfo = uri.UserInfo.Split(':', 2);
    var db = uri.AbsolutePath.TrimStart('/');
    var port = uri.Port > 0 ? uri.Port : 5432;

    return $"Host={uri.Host};Port={port};Database={db};Username={userInfo[0]};" +
           $"Password={(userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "")};" +
           "SSL Mode=Require;Trust Server Certificate=true";
}
