# core/middleware.py
from django.conf import settings
from django.shortcuts import redirect
from django.urls import resolve

# Public endpoints that must bypass auth (icons/manifest/etc.)
EXEMPT_PREFIXES = (
    "/accounts/",
    "/admin/",
    "/static/",
    "/media/",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/site.webmanifest",
    "/manifest.webmanifest",
    "/manifest.json",
    "/sw.js",
    "/service-worker.js",
    "/robots.txt",
    "/.well-known/",
)

# If you used RedirectView routes for icons, exempt by URL name too.
EXEMPT_URL_NAMES = {
    "apple_touch_icon",
    "apple_touch_icon_pre",
    "favicon_root",
}


class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        p = request.path

        # already authed -> allow
        if request.user.is_authenticated:
            return self.get_response(request)

        # allow by prefix
        if any(p.startswith(pref) for pref in EXEMPT_PREFIXES):
            return self.get_response(request)

        # allow by named route (e.g., your RedirectView names) and allauth app
        try:
            match = resolve(p)
            if match.url_name in EXEMPT_URL_NAMES or match.app_name == "account":
                return self.get_response(request)
        except Exception:
            pass

        # everything else -> force login
        return redirect(settings.LOGIN_URL)
