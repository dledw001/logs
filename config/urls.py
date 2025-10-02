"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

from core import views as core_views
from django.conf import settings
from django.conf.urls.static import static
from django.templatetags.static import static as static_url

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("books/", include(("logbooks.urls", "logbooks"), namespace="logbooks")),
    path("", core_views.root, name="root"),
    path("dashboard/", core_views.dashboard, name="dashboard"),
    # other #
    path(
        "favicon.ico",
        RedirectView.as_view(url=static_url("favicon.ico"), permanent=False),
    ),
    path(
        "apple-touch-icon.png",
        RedirectView.as_view(url=static_url("apple-touch-icon.png"), permanent=False),
    ),
    path(
        "apple-touch-icon-precomposed.png",
        RedirectView.as_view(
            url=static_url("apple-touch-icon-precomposed.png"), permanent=False
        ),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
