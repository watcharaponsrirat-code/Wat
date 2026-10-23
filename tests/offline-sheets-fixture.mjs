// Apply only to legacy demo/offline UI regressions. Configured integration tests
// provide their own synthetic backend and must not use this fixture.
// Synthetic legacy identities remain outside all deployable site files.
export const offlineSheetsSource = `window.SLH_SHEETS_CONFIG={endpoint:""};
window.__SLH_TEST_AUTH__={
  defaultUser:{id:'M20105',name:'M20105',teacher:false,grade:2},
  authenticate(username,password){
    const accounts={teacher:{name:'ครูผู้สอน',teacher:true,grade:null},M20105:{name:'M20105',teacher:false,grade:2}};
    return password==='1234'&&Object.prototype.hasOwnProperty.call(accounts,username)?{id:username,...accounts[username]}:null;
  }
};`;
export async function useOfflineSheets(pageOrContext) {
  await pageOrContext.route('**/assets/integrations/sheets-config.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: offlineSheetsSource,
  }));
  // A missed configuration override must fail locally, never contact live data.
  await pageOrContext.route('https://script.google.com/**', route => route.abort('blockedbyclient'));
  await pageOrContext.route('https://script.googleusercontent.com/**', route => route.abort('blockedbyclient'));
}
