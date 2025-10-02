from django import forms
from .models import LogBook, Entry


class LogBookForm(forms.ModelForm):
    class Meta:
        model = LogBook
        fields = ["title", "description"]


class EntryForm(forms.ModelForm):
    class Meta:
        model = Entry
        fields = ["number", "short_text", "long_text", "occurred_at"]
        widgets = {
            "occurred_at": forms.DateTimeInput(
                attrs={"type": "datetime-local"},
                format="%Y-%m-%dT%H:%M",
            )
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["occurred_at"].input_formats = ["%Y-%m-%dT%H:%M"]
