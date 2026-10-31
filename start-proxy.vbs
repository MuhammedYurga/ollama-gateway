' Ayni klasordeki gateway'i gizli pencerede baslatir (startup icin).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "node anthropic-proxy.js", 0, False
