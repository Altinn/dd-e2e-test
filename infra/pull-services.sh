#!/usr/bin/env bash
set -euo pipefail

rm -rf ./services

git clone https://github.com/Altinn/app-localtest.git ./services/app-localtest
git clone https://altinn.studio/repos/digdir/oed.git ./services/oed
git clone https://altinn.studio/repos/digdir/oed-declaration.git ./services/oed-declaration

cp ./app-localtest/src/Services/LocalApp/Implementation/LocalAppHttp.cs ./services/app-localtest/src/Services/LocalApp/Implementation/LocalAppHttp.cs

registration=./services/oed/App/HttpClients/HttpClientsRegistration.cs
sed 's|https://{oedOptions\.Host}|http://{oedOptions.Host}|g' "$registration" > "$registration.tmp"
mv "$registration.tmp" "$registration"
