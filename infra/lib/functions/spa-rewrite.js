// CloudFront Function (viewer request, cloudfront-js-2.0) for SPA routing on the
// default behavior. API and media paths never reach this behavior, the prefix check
// is defense in depth so their 404s are never turned into index.html.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.startsWith("/api/") || uri.startsWith("/media/")) return request;
  var last = uri.substring(uri.lastIndexOf("/") + 1);
  if (last.indexOf(".") === -1) request.uri = "/index.html";
  return request;
}
