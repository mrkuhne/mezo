package io.mrkuhne.mezo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MezoApplication {

	public static void main(String[] args) {
		SpringApplication.run(MezoApplication.class, args);
	}

}
