docker build -t petclinic-ui-eks .
docker tag petclinic-ui-eks:latest $1
docker push $1
