from django import forms
from .models import LogBook, Entry


class LogBookForm(forms.ModelForm):
    class Meta:
        model = LogBook
        fields = ["title", "description"]


class EntryForm(forms.ModelForm):
    FIELD_CHOICES = [
        ("number", "Number"),
        ("number_array", "Number Array"),
        ("short_text", "Short Text"),
        ("long_text", "Long Text"),
    ]

    field_type = forms.ChoiceField(
        choices=FIELD_CHOICES,
        initial="number",
        widget=forms.Select(
            attrs={"class": "form-select", "id": "field-type-selector"}
        ),
    )

    number_array_input = forms.CharField(
        required=False,
        widget=forms.Textarea(
            attrs={
                "class": "form-control",
                "rows": 3,
                "placeholder": "Enter numbers, one per line or comma-separated",
            }
        ),
    )

    class Meta:
        model = Entry
        fields = [
            "number",
            "number_array",
            "short_text",
            "long_text",
            "occurred_at"
        ]
        widgets = {
            "occurred_at": forms.DateTimeInput(
                attrs={"type": "datetime-local"},
                format="%Y-%m-%dT%H:%M",
            ),
            "number": forms.NumberInput(
                attrs={"class": "form-control", "step": "0.001"}
            ),
            "short_text": forms.TextInput(attrs={"class": "form-control"}),
            "long_text": forms.Textarea(attrs={"class": "form-control", "rows": 6}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["occurred_at"].input_formats = ["%Y-%m-%dT%H:%M"]

        self.fields["number_array"].widget = forms.HiddenInput()
        self.fields["number_array"].required = False

        if self.instance and self.instance.pk and self.instance.number_array:
            self.fields["number_array_input"].initial = ", ".join(
               str(n) for n in self.instance.number_array
            )

        if self.instance and self.instance.pk:
            if self.instance.number is not None:
                self.fields["field_type"].initial = "number"
            elif self.instance.number_array:
               self.fields["field_type"].initial = "number_array"
            elif self.instance.short_text:
                self.fields["field_type"].initial = "short_text"
            elif self.instance.long_text:
                self.fields["field_type"].initial = "long_text"

    def clean_number_array_input(self):
        data = self.cleaned_data.get("number_array_input", "")
        if not data or not data.strip():
            return []

        numbers = []
        items = data.replace(",", "\n").split("\n")

        for item in items:
            item = item.strip()
            if not item:
                continue
            try:
                numbers.append(float(item))
            except ValueError:
                raise forms.ValidationError(f'Invalid number: "{item}"')

        return numbers

    def save(self, commit=True):
        instance = super().save(commit=False)
        if "number_array_input" in self.cleaned_data:
            instance.number_array = self.cleaned_data["number_array_input"]
        if commit:
            instance.save()
        return instance
