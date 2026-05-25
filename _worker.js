export default {
  async fetch(request, env, context) {
    var response = await env.ASSETS.fetch(request);
    var headers = new Headers(response.headers);
    var pathname = new URL(request.url).pathname;

    if (pathname.indexOf("/assets/") === 0) {
      headers.set("Cache-Control", "public, max-age=2592000, immutable");
    } else {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }
};