docker build -t petclinic-vets-eks .
docker tag petclinic-vets-eks:latest $1
docker push $1
