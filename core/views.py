from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from logbooks.models import LogBook


def home(request):
    return render(request, "core/home.html")


def root(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return redirect("account_login")


@login_required
def dashboard(request):
    return render(request, "core/dashboard.html")
