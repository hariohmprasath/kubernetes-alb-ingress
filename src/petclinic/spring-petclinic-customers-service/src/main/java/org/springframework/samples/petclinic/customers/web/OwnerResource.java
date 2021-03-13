/*
 * Copyright 2002-2017 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.springframework.samples.petclinic.customers.web;

import java.util.List;
import java.util.Optional;

import javax.sql.DataSource;

import io.micrometer.core.annotation.Timed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.samples.petclinic.customers.model.Owner;
import org.springframework.samples.petclinic.customers.model.OwnerRepository;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;


@RequestMapping("/owners")
@RestController
@Timed("petclinic.owner")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin
class OwnerResource {

    private final OwnerRepository ownerRepository;

    @Autowired
    private DataSource dataSource;

    /**
     * Create Owner
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Owner createOwner(@RequestBody Owner owner) {
        return ownerRepository.save(owner);
    }

    /**
     * Read single Owner
     */
    @GetMapping(value = "/{ownerId}")
    public Optional<Owner> findOwner(@PathVariable("ownerId") int ownerId) {
        return ownerRepository.findById(ownerId);
    }

    /**
     * Read List of Owners
     */
    @GetMapping
    public List<Owner> findAll() {
        return ownerRepository.findAll();
    }

    /**
     * Update Owner
     */
    @PutMapping(value = "/{ownerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateOwner(@PathVariable("ownerId") int ownerId, @RequestBody Owner ownerRequest) throws Exception {
        // Fetch Subsegment
        final Optional<Owner> owner = ownerRepository.findById(ownerId);

        final Owner ownerModel = owner
            .orElseThrow(() -> (Exception) new ResourceNotFoundException("Owner " + ownerId + " not found"));

        ownerModel.setFirstName(ownerRequest.getFirstName());
        ownerModel.setLastName(ownerRequest.getLastName());
        ownerModel.setCity(ownerRequest.getCity());
        ownerModel.setAddress(ownerRequest.getAddress());
        ownerModel.setTelephone(ownerRequest.getTelephone());

        // Save Subsegment
        log.info("Saving owner {}", ownerModel);
        ownerRepository.save(ownerModel);
    }

    @PutMapping(value = "/boostrap")
    public ResponseEntity<String> bootstrap() {
        try {
            ResourceDatabasePopulator resourceDatabasePopulator = new ResourceDatabasePopulator
                (false, false, "UTF-8", new ClassPathResource("seedData.sql"));
            resourceDatabasePopulator.execute(dataSource);
            log.info("Database successfully initialized for petclinic");
            return new ResponseEntity<>("", HttpStatus.OK);
        }
        catch (Exception e) {
            String error = "Error while initializing data " + e.getMessage();
            log.info(error, e);
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
