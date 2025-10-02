from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
)
from django.shortcuts import get_object_or_404
from .models import LogBook, Entry
from .forms import LogBookForm, EntryForm


# ----- LogBooks -----
class OwnerQuerysetMixin(LoginRequiredMixin):
    def get_queryset(self):
        return LogBook.objects.filter(owner=self.request.user)


class BookList(OwnerQuerysetMixin, ListView):
    model = LogBook
    template_name = "logbooks/book_list.html"
    context_object_name = "books"
    ordering = ["title"]


class BookDetail(OwnerQuerysetMixin, DetailView):
    model = LogBook
    slug_field = "slug"
    slug_url_kwarg = "slug"
    template_name = "logbooks/book_detail.html"
    context_object_name = "book"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["entries"] = self.object.entries.order_by("-occurred_at", "-id")
        return ctx


class BookCreate(LoginRequiredMixin, CreateView):
    model = LogBook
    form_class = LogBookForm
    template_name = "logbooks/book_form.html"

    def form_valid(self, form):
        form.instance.owner = self.request.user
        messages.success(self.request, "Log book created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("logbooks:detail", args=[self.object.slug])


class BookUpdate(OwnerQuerysetMixin, UpdateView):
    model = LogBook
    form_class = LogBookForm
    slug_field = "slug"
    slug_url_kwarg = "slug"
    template_name = "logbooks/book_form.html"

    def form_valid(self, form):
        messages.success(self.request, "Log book updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("logbooks:detail", args=[self.object.slug])


class BookDelete(OwnerQuerysetMixin, DeleteView):
    model = LogBook
    slug_field = "slug"
    slug_url_kwarg = "slug"
    template_name = "logbooks/book_confirm_delete.html"
    success_url = reverse_lazy("logbooks:list")

    def delete(self, request, *args, **kwargs):
        messages.success(self.request, "Log book deleted.")
        return super().delete(request, *args, **kwargs)


# ----- Entries (nested under a book) -----
class BookLookupMixin(LoginRequiredMixin):
    """Load the parent book owned by the current user."""

    book: LogBook

    def dispatch(self, request, *args, **kwargs):
        self.book = get_object_or_404(LogBook, owner=request.user, slug=kwargs["slug"])
        return super().dispatch(request, *args, **kwargs)

    def get_success_url(self):
        return reverse("logbooks:detail", args=[self.book.slug])

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["book"] = self.book
        return ctx


class EntryCreate(BookLookupMixin, CreateView):
    model = Entry
    form_class = EntryForm
    template_name = "logbooks/entry_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["book"] = self.book
        return ctx

    def form_valid(self, form):
        form.instance.book = self.book
        messages.success(self.request, "Entry added.")
        return super().form_valid(form)


class EntryUpdate(BookLookupMixin, UpdateView):
    model = Entry
    form_class = EntryForm
    template_name = "logbooks/entry_form.html"

    def get_queryset(self):
        return Entry.objects.filter(
            book__owner=self.request.user, book__slug=self.kwargs["slug"]
        )

    def form_valid(self, form):
        messages.success(self.request, "Entry updated.")
        return super().form_valid(form)


class EntryDelete(BookLookupMixin, DeleteView):
    model = Entry
    template_name = "logbooks/entry_confirm_delete.html"

    def get_queryset(self):
        return Entry.objects.filter(
            book__owner=self.request.user, book__slug=self.kwargs["slug"]
        )

    def delete(self, request, *args, **kwargs):
        messages.success(self.request, "Entry deleted.")
        return super().delete(request, *args, **kwargs)
