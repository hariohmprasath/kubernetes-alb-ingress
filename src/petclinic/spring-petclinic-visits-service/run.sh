docker build -t petclinic-visits-eks .
docker tag petclinic-visits-eks:latest $1
docker push $1
