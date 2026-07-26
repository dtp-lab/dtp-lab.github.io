const pagePath = (pathname) => {
  if (pathname === "/") return "/index.html";
  if (pathname.endsWith("/")) return `${pathname}index.html`;
  const finalSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return finalSegment.includes(".") ? pathname : `${pathname}.html`;
};

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    url.pathname = pagePath(url.pathname);
    return env.ASSETS.fetch(new Request(url, request));
  },
};
