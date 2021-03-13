package org.springframework.samples.petclinic.vets;

import javax.sql.DataSource;

import com.amazonaws.services.secretsmanager.AWSSecretsManager;
import com.amazonaws.services.secretsmanager.AWSSecretsManagerClientBuilder;
import com.amazonaws.services.secretsmanager.model.GetSecretValueRequest;
import com.amazonaws.services.secretsmanager.model.GetSecretValueResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableAutoConfiguration
public class VetsWebConfig {

    private final AWSSecretsManager SECRET_MANAGER = AWSSecretsManagerClientBuilder.standard()
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource")
    public DataSource dataSource() throws Exception {
        final String secretName = System.getenv("SECRETS_NAME");
        String[] split = secretName.split("-");
        final GetSecretValueRequest request = new GetSecretValueRequest().withSecretId(split[0] + "-" + split[1]);
        final GetSecretValueResult result = SECRET_MANAGER.getSecretValue(request);
        final String secretString = result.getSecretString();
        final JsonNode jsonNode = mapper.readTree(secretString);
        return DataSourceBuilder.create()
                .driverClassName("com.mysql.cj.jdbc.Driver")
                .url("jdbc:mysql://" + jsonNode.get("host").asText() + ":3306/petclinic?createDatabaseIfNotExist=true")
                .username(jsonNode.get("username").asText())
                .password(jsonNode.get("password").asText())
                .build();
    }
}
