package io.mrkuhne.mezo.techcore.configuration;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * Content-hash ETags for the meal photo GET only. The generated API pins {@code @ResponseStatus(OK)},
 * which would overwrite a 304 written from inside the controller, so conditional GETs are handled
 * by this filter instead: a replaced photo has different bytes -> a different ETag -> served fresh;
 * an unchanged one costs a 304 with no body.
 */
@Configuration
public class PhotoEtagConfiguration {

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> mealPhotoEtagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> bean = new FilterRegistrationBean<>(new ShallowEtagHeaderFilter() {
            @Override
            protected boolean shouldNotFilter(jakarta.servlet.http.HttpServletRequest request) {
                // servlet url-patterns cannot wildcard a middle segment, so match /api/meal/{id}/photo here
                return !"GET".equals(request.getMethod()) || !request.getRequestURI().matches("/api/meal/[^/]+/photo");
            }
        });
        bean.addUrlPatterns("/api/meal/*");
        bean.setName("mealPhotoEtagFilter");
        return bean;
    }
}
