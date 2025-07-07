# dd-e2e-test

Digitalt Dødsbo end to end tests

# Infrastructure

## Docker compose

I katalogen `./infra` ligger scripts og docker compose file for å kunne spinne opp miljøet for digitalt dødsbo i docker og kjøre tester mot dette.

1. Kjør scriptet `pull-services.ps1`. Dette vil clone nødevndige git repos fra git/gitea.
2. Kjør `docker compose build` for å bygge nødvendige docker images fra source som clones fra steg 1.
3. Kjør `docker compose up` for å starte alle tjenestene i et docker cluster
4. Naviger til [local.altinn.cloud](http://local.altinn.cloud/) for å simulere login.
