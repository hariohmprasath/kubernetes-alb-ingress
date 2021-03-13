mvn clean install -DskipTests=true
cd spring-petclinic-api-gateway
./run.sh $1
cd ../spring-petclinic-customer-service
./run.sh $2
cd ../spring-petclinic-vets-service
./run.sh $3
cd ../spring-petclinic-visits-service
./run.sh $4
