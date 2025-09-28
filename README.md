# logs

## get it running

### requirements: 
    - postgresql (see example.env)
    - see requirements file (install via pip, see below)

### then
    - create and launch python virtual environment
    - pip install -r requirements.txt
    - python manage.py makemigrations
    - python manage.py migrate
    - python manage.py createsuperuser
    - python manage.py runserver 0.0.0.0:8080
    - http://localhost:8080

