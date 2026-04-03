# This script builds the PNG icon files used by the Chrome extension.
# It keeps the icon set easy to refresh if we tweak the brand later.

param(
  [string]$OutputDir = (Join-Path $PSScriptRoot "..\\icons")
)

Add-Type -AssemblyName System.Drawing

$script:BaseSize = 128.0
$script:Palette = @{
  TileStart = [System.Drawing.ColorTranslator]::FromHtml("#174A61")
  TileEnd = [System.Drawing.ColorTranslator]::FromHtml("#081A29")
  TileEdge = [System.Drawing.ColorTranslator]::FromHtml("#2F6F84")
  Glow = [System.Drawing.Color]::FromArgb(92, 120, 224, 202)
  ShieldStart = [System.Drawing.ColorTranslator]::FromHtml("#2A6F86")
  ShieldEnd = [System.Drawing.ColorTranslator]::FromHtml("#12384E")
  ShieldOutline = [System.Drawing.ColorTranslator]::FromHtml("#9BE5D0")
  Pulse = [System.Drawing.ColorTranslator]::FromHtml("#F4FFFC")
  AccentDot = [System.Drawing.ColorTranslator]::FromHtml("#88D7C1")
  Shadow = [System.Drawing.Color]::FromArgb(26, 5, 22, 36)
}

function Scale-Value {
  param(
    [double]$Value,
    [int]$Size
  )

  return [float]($Value * ($Size / $script:BaseSize))
}

function New-Point {
  param(
    [double]$X,
    [double]$Y,
    [int]$Size
  )

  return [System.Drawing.PointF]::new((Scale-Value -Value $X -Size $Size), (Scale-Value -Value $Y -Size $Size))
}

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function New-ShieldPath {
  param(
    [int]$Size
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath

  $path.StartFigure()
  $path.AddLine((New-Point -X 64 -Y 24 -Size $Size), (New-Point -X 86 -Y 31 -Size $Size))
  $path.AddBezier(
    (New-Point -X 86 -Y 31 -Size $Size),
    (New-Point -X 91 -Y 32.6 -Size $Size),
    (New-Point -X 94 -Y 35.8 -Size $Size),
    (New-Point -X 94 -Y 40 -Size $Size)
  )
  $path.AddLine((New-Point -X 94 -Y 40 -Size $Size), (New-Point -X 94 -Y 58 -Size $Size))
  $path.AddBezier(
    (New-Point -X 94 -Y 58 -Size $Size),
    (New-Point -X 94 -Y 77 -Size $Size),
    (New-Point -X 82 -Y 90 -Size $Size),
    (New-Point -X 64 -Y 102 -Size $Size)
  )
  $path.AddBezier(
    (New-Point -X 64 -Y 102 -Size $Size),
    (New-Point -X 46 -Y 90 -Size $Size),
    (New-Point -X 34 -Y 77 -Size $Size),
    (New-Point -X 34 -Y 58 -Size $Size)
  )
  $path.AddLine((New-Point -X 34 -Y 58 -Size $Size), (New-Point -X 34 -Y 40 -Size $Size))
  $path.AddBezier(
    (New-Point -X 34 -Y 40 -Size $Size),
    (New-Point -X 34 -Y 35.8 -Size $Size),
    (New-Point -X 37 -Y 32.6 -Size $Size),
    (New-Point -X 42 -Y 31 -Size $Size)
  )
  $path.AddLine((New-Point -X 42 -Y 31 -Size $Size), (New-Point -X 64 -Y 24 -Size $Size))
  $path.CloseFigure()

  return $path
}

function New-IconPenWidth {
  param(
    [int]$Size,
    [string]$Kind
  )

  switch ($Kind) {
    "tile" {
      if ($Size -le 16) { return 1.0 }
      if ($Size -le 32) { return 1.3 }
      if ($Size -le 48) { return 1.5 }
      return 2.0
    }
    "outline" {
      if ($Size -le 16) { return 1.1 }
      if ($Size -le 32) { return 1.7 }
      if ($Size -le 48) { return 2.2 }
      return 3.0
    }
    "pulse" {
      if ($Size -le 16) { return 1.9 }
      if ($Size -le 32) { return 3.0 }
      if ($Size -le 48) { return 4.0 }
      return 6.0
    }
    "dot" {
      if ($Size -le 16) { return 0 }
      if ($Size -le 32) { return 2.2 }
      if ($Size -le 48) { return 3.2 }
      return 5.0
    }
  }
}

function New-IconBitmap {
  param(
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $tilePath = New-RoundedRectanglePath `
      -X (Scale-Value -Value 6 -Size $Size) `
      -Y (Scale-Value -Value 6 -Size $Size) `
      -Width (Scale-Value -Value 116 -Size $Size) `
      -Height (Scale-Value -Value 116 -Size $Size) `
      -Radius (Scale-Value -Value 28 -Size $Size)

    if ($Size -ge 32) {
      $shadowPath = New-RoundedRectanglePath `
        -X (Scale-Value -Value 6 -Size $Size) `
        -Y (Scale-Value -Value 9 -Size $Size) `
        -Width (Scale-Value -Value 116 -Size $Size) `
        -Height (Scale-Value -Value 116 -Size $Size) `
        -Radius (Scale-Value -Value 28 -Size $Size)

      $shadowBrush = New-Object System.Drawing.SolidBrush($script:Palette.Shadow)
      try {
        $graphics.FillPath($shadowBrush, $shadowPath)
      }
      finally {
        $shadowBrush.Dispose()
        $shadowPath.Dispose()
      }
    }

    $tileBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Point -X 18 -Y 14 -Size $Size),
      (New-Point -X 112 -Y 114 -Size $Size),
      $script:Palette.TileStart,
      $script:Palette.TileEnd
    )
    $tilePen = New-Object System.Drawing.Pen($script:Palette.TileEdge, (New-IconPenWidth -Size $Size -Kind "tile"))

    try {
      $graphics.FillPath($tileBrush, $tilePath)
    }
    finally {
      $tileBrush.Dispose()
    }

    if ($Size -ge 24) {
      $glowBrush = New-Object System.Drawing.SolidBrush($script:Palette.Glow)
      try {
        $graphics.FillEllipse(
          $glowBrush,
          (Scale-Value -Value 10 -Size $Size),
          (Scale-Value -Value 8 -Size $Size),
          (Scale-Value -Value 66 -Size $Size),
          (Scale-Value -Value 58 -Size $Size)
        )
      }
      finally {
        $glowBrush.Dispose()
      }
    }

    try {
      $graphics.DrawPath($tilePen, $tilePath)
    }
    finally {
      $tilePath.Dispose()
      $tilePen.Dispose()
    }

    $shieldPath = New-ShieldPath -Size $Size
    $shieldBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Point -X 42 -Y 24 -Size $Size),
      (New-Point -X 84 -Y 102 -Size $Size),
      $script:Palette.ShieldStart,
      $script:Palette.ShieldEnd
    )
    $shieldPen = New-Object System.Drawing.Pen($script:Palette.ShieldOutline, (New-IconPenWidth -Size $Size -Kind "outline"))
    $shieldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    try {
      $graphics.FillPath($shieldBrush, $shieldPath)
      $graphics.DrawPath($shieldPen, $shieldPath)
    }
    finally {
      $shieldBrush.Dispose()
      $shieldPen.Dispose()
      $shieldPath.Dispose()
    }

    $pulsePoints = [System.Drawing.PointF[]]@(
      (New-Point -X 43 -Y 64 -Size $Size),
      (New-Point -X 53 -Y 64 -Size $Size),
      (New-Point -X 58.5 -Y 52 -Size $Size),
      (New-Point -X 66 -Y 77 -Size $Size),
      (New-Point -X 72.5 -Y 59 -Size $Size),
      (New-Point -X 84 -Y 59 -Size $Size)
    )

    $pulsePen = New-Object System.Drawing.Pen($script:Palette.Pulse, (New-IconPenWidth -Size $Size -Kind "pulse"))
    $pulsePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pulsePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pulsePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    try {
      $graphics.DrawLines($pulsePen, $pulsePoints)
    }
    finally {
      $pulsePen.Dispose()
    }

    $dotRadius = New-IconPenWidth -Size $Size -Kind "dot"

    if ($dotRadius -gt 0) {
      $dotBrush = New-Object System.Drawing.SolidBrush($script:Palette.AccentDot)
      try {
        $graphics.FillEllipse(
          $dotBrush,
          (Scale-Value -Value (86.5 - $dotRadius) -Size $Size),
          (Scale-Value -Value (46.5 - $dotRadius) -Size $Size),
          ($dotRadius * 2),
          ($dotRadius * 2)
        )
      }
      finally {
        $dotBrush.Dispose()
      }
    }
  }
  finally {
    $graphics.Dispose()
  }

  return $bitmap
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$sizes = 16, 32, 48, 128

foreach ($size in $sizes) {
  $bitmap = New-IconBitmap -Size $size
  $outputPath = Join-Path $OutputDir ("icon{0}.png" -f $size)

  try {
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ("Built {0}" -f $outputPath)
  }
  finally {
    $bitmap.Dispose()
  }
}
