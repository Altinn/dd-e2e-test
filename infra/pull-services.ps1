Remove-Item -Path "./services" -Recurse -Force

git clone https://github.com/Altinn/app-localtest.git ./services/app-localtest
git clone https://altinn.studio/repos/digdir/oed.git ./services/oed
git clone https://altinn.studio/repos/digdir/oed-declaration.git ./services/oed-declaration