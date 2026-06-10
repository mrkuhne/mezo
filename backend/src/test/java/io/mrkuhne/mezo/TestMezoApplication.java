package io.mrkuhne.mezo;

import org.springframework.boot.SpringApplication;

public class TestMezoApplication {

	public static void main(String[] args) {
		SpringApplication.from(MezoApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
