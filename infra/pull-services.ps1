Remove-Item -Path "./services" -Recurse -Force

git clone https://github.com/Altinn/app-localtest.git ./services/app-localtest
git clone https://altinn.studio/repos/digdir/oed.git ./services/oed
git clone https://altinn.studio/repos/digdir/oed-declaration.git ./services/oed-declaration

Copy-Item ./app-localtest/src/Services/LocalApp/Implementation/LocalAppHttp.cs ./services/app-localtest/src/Services/LocalApp/Implementation/LocalAppHttp.cs

(Get-Content ./services/oed/App/HttpClients/HttpClientsRegistration.cs).Replace('https://{oedOptions.Host}', 'http://{oedOptions.Host}') | Set-Content ./services/oed/App/HttpClients/HttpClientsRegistration.cs