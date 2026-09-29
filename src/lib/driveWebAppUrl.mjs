export function validDriveWebAppUrl(url) {
  return typeof url === 'string' &&
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
}
