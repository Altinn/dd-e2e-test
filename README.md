# Digitalt Dødsbo E2E Tests

End-to-end tests for Digitalt Dødsbo, focusing on the OED application in the TT02 environment.

## Overview

This project uses [Playwright](https://playwright.dev/) to automate testing. The tests runs against the TT02 environment (`tt02.altinn.no`).

Here is the link to the Confluence page: [Digitalt Dødsbo E2E Tests](https://digdir.atlassian.net/wiki/spaces/BTDD/pages/3657203813/Playwright)

In there you can find the test plan and test cases together with the user names and social security numbers.

### Current Implementation Status
- **Authentication**: Implemented in `global-setup.ts`. Logs in using ID-porten (TestID), selects the correct user profile, and saves the session state.
- **Homepage**: Checks for correct title, deceased name heading, and logged-in heir name.
- **Person Details**: Verifies navigation to the "Person details" page and checks if the heir is listed.


## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

### Configuration

Create a `.env` file in the root directory with the following variables:

```ini
# Social Security Number for the Heir (TestID User)
HEIR_SSN=01010112345

# Name of the Heir (Must match the user associated with the SSN in TT02)
HEIR_NAME=Ola Nordmann

# Name of the Deceased (To verify the correct case is opened)
DECEASSED_NAME=Kari Nordmann

# Base URL is dynamically set during login, but can be overridden if needed
# BASE_URL=...
```

**Note:** You need valid TestID credentials for TT02. Ensure the user (`HEIR_SSN`) has access to a deceased estate ("Digitalt dødsbo") in the Altinn TT02 environment.

### Running Tests

To run the tests:

```bash
npx playwright test
```

This will:
1. Run the `global-setup.ts` script to authenticate and save the session to `storageState.json`.
2. Execute the test specifications in the `tests/` folder using the saved session.
3. Generate an HTML report.

To view the test report:

```bash
npx playwright show-report
```
## It is agreed by the team that these tests will be run manually for now and will be part of CI/CD pipeline in the future.

## Here is the guide for running tests in Azure DevOps:

### Setting up the Pipeline

azure-pipelines.yml is already set up in the repository.

1.  **Create Pipeline**: Go to Azure DevOps > Pipelines > New Pipeline. Select your repository and point it to the existing `azure-pipelines.yml` file.
2.  **Define Variables**: You must define the environment variables in the pipeline settings or a Variable Group (Library) so that they are not committed to source control.
    *   `HEIR_SSN`: The SSN of the test user.
    *   `HEIR_NAME`: The name of the test user.
    *   `DECEASSED_NAME`: The name of the deceased.
3.  **Run Pipeline**: The pipeline is configured to:
    *   Install Node.js and dependencies.
    *   Install Playwright browsers.
    *   Run tests.
    *   Publish the test report (HTML) and JUnit results (viewable in the "Tests" tab).

### Project Structure

- `global-setup.ts`: Handles the initial login flow and saves authentication state.
- `tests/`: Contains the test specifications.
  - `homepage.spec.ts`: Basic checks on the landing page.
  - `personaldata.spec.ts`: Checks on the personal data/heirs page.
- `playwright.config.ts`: Main configuration for Playwright.
- `infra/`: (See below) Local infrastructure scripts.

### Infrastructure (Local)

The `infra` folder contains scripts and docker compose files to spin up a local environment for Digitalt Dødsbo.

1. Run `pull-services.ps1` to clone necessary repos.
2. Run `docker compose build` to build images.
3. Run `docker compose up` to start services.
4. Navigate to [local.altinn.cloud](http://local.altinn.cloud/) to simulate login.
