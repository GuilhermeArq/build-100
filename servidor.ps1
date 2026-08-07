$port = 8080
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $port = 8085
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " 🚀 SERVIDOR LOCAL - GUIA (TCC)" -ForegroundColor Green
Write-Host " Servidor rodando em: $prefix" -ForegroundColor Yellow
Write-Host " O navegador foi aberto automaticamente!" -ForegroundColor White
Write-Host " Para encerrar o servidor, feche esta janela." -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process $prefix

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".pdf"  = "application/pdf"
    ".ico"  = "image/x-icon"
}

$rootFolder = $PSScriptRoot

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        if ($rawUrl -eq "/") { $rawUrl = "/index.html" }

        $filePath = [System.IO.Path]::Combine($rootFolder, $rawUrl.TrimStart("/").Replace("/", "\"))

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            if ($mimeTypes.ContainsKey($ext)) {
                $response.ContentType = $mimeTypes[$ext]
            } else {
                $response.ContentType = "application/octet-stream"
            }

            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBuffer = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo não encontrado")
            $response.ContentLength64 = $notFoundBuffer.Length
            $response.OutputStream.Write($notFoundBuffer, 0, $notFoundBuffer.Length)
        }
        $response.OutputStream.Close()
    } catch {
        # Ignora desconexões normais de requisições
    }
}
