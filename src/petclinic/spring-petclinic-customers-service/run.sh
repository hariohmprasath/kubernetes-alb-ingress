docker build -t petclinic-customer-eks .
docker tag petclinic-customer-eks:latest $1
docker push $1
