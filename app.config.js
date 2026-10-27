// Extends app.json. Integration builds (the EAS development, preview and testflight-staging
// profiles set APP_VARIANT=integration) also associate with the staging website so Universal
// Links can be tested without touching the production domain. Every other build, including
// production, keeps only the app.json association (applinks:www.tripideas.nz).
const INTEGRATION_ASSOCIATED_DOMAIN = 'applinks:staging.tripideas.nz';

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'integration') return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: [
        ...(config.ios?.associatedDomains ?? []),
        INTEGRATION_ASSOCIATED_DOMAIN,
      ],
    },
  };
};
