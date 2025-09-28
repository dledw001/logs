from django.urls import path
from . import views

app_name = "logbooks"

urlpatterns = [
    # logbooks
    path("", views.BookList.as_view(), name="list"),
    path("new/", views.BookCreate.as_view(), name="create"),
    path("<slug:slug>/", views.BookDetail.as_view(), name="detail"),
    path("<slug:slug>/edit/", views.BookUpdate.as_view(), name="update"),
    path("<slug:slug>/delete/", views.BookDelete.as_view(), name="delete"),

    # entries (nested)
    path("<slug:slug>/entries/new/", views.EntryCreate.as_view(), name="entry_create"),
    path("<slug:slug>/entries/<int:pk>/edit/", views.EntryUpdate.as_view(), name="entry_update"),
    path("<slug:slug>/entries/<int:pk>/delete/", views.EntryDelete.as_view(), name="entry_delete"),
]
