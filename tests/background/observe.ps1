param([string]$Profile,[string]$StateFile)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class BrowserWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
'@
$owners=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Replace('/','\') -match ('--user-data-dir="?' + [regex]::Escape($Profile) + '(?=["\s]|$)') -and $_.CommandLine -notmatch ' --type='
})
if($owners.Count -ne 1){throw 'Cannot identify unique fixture Chrome process'}
$proc=Get-Process -Id $owners[0].ProcessId
$hw=$proc.MainWindowHandle
if($hw -eq 0){throw 'No visible fixture browser handle'}
$previous=''
$lastWrite=[datetime]::MinValue
while([BrowserWindow]::IsWindow($hw)){
    $state=if([BrowserWindow]::IsIconic($hw)){'minimized'}elseif([BrowserWindow]::GetForegroundWindow() -eq $hw){'foreground'}else{'covered'}
    if(!$StateFile){[Console]::WriteLine($state)}
    elseif($state -ne $previous -or ([datetime]::UtcNow-$lastWrite).TotalSeconds -ge 1){
        $lastWrite=[datetime]::UtcNow
        $line=@{time=$lastWrite.ToString('o');state=$state}|ConvertTo-Json -Compress
        [IO.File]::AppendAllText($StateFile,$line+[Environment]::NewLine)
        $previous=$state
    }
    Start-Sleep -Milliseconds 100
}

