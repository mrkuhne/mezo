package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AdminApi;
import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.feature.auth.service.AdminService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/admin surface (mezo-qw37.3) — every method starts with the owner gate. */
@RestController
@RequiredArgsConstructor
public class AdminController implements AdminApi {

    private final AdminService adminService;
    private final CurrentUser currentUser;

    @Override
    public InviteResponse createInvite(CreateInviteRequest request) {
        return adminService.createInvite(currentUser.requireOwner(), request);
    }

    @Override
    public List<InviteResponse> listInvites() {
        currentUser.requireOwner();
        return adminService.listInvites();
    }

    @Override
    public void deleteInvite(UUID id) {
        currentUser.requireOwner();
        adminService.deleteInvite(id);
    }

    @Override
    public List<AdminUserResponse> listUsers() {
        currentUser.requireOwner();
        return adminService.listUsers();
    }

    @Override
    public ResetPasswordResponse resetPassword(UUID id) {
        currentUser.requireOwner();
        return adminService.resetPassword(id);
    }

    @Override
    public void setStatus(UUID id, SetUserStatusRequest request) {
        adminService.setStatus(currentUser.requireOwner(), id, request);
    }
}
