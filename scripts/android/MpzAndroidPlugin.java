package app.lovable.dfc9e1d2017c4c4499328af8ac12f08f;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;

@CapacitorPlugin(name = "MpzAndroid", permissions = {
    @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS })
})
public class MpzAndroidPlugin extends Plugin {
    private boolean saving = false;

    @PluginMethod
    public void savePdf(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        if (filename == null || data == null || data.isEmpty()) {
            call.reject("PDF inválido.");
            return;
        }
        if (saving) {
            call.reject("Conclua o salvamento anterior.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[\\\\/:*?\"<>|]", "_"));
        saving = true;
        try {
            startActivityForResult(call, intent, "pdfSaved");
        } catch (Exception error) {
            saving = false;
            call.reject("Não foi possível abrir o salvamento do PDF.", error);
        }
    }

    @ActivityCallback
    private void pdfSaved(PluginCall call, ActivityResult result) {
        saving = false;
        if (call == null) return;
        JSObject response = new JSObject();
        Intent intent = result.getData();
        Uri uri = intent == null ? null : intent.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        String data = call.getString("data");
        if (data == null) {
            call.reject("PDF indisponível. Gere o arquivo novamente.");
            return;
        }
        // Write only to the location explicitly chosen by the user, with no broad storage permission.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new java.io.IOException("Arquivo indisponível");
                stream.write(Base64.decode(data, Base64.DEFAULT));
                stream.flush();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Não foi possível salvar o PDF na pasta escolhida.", error);
            }
        });
    }

    @PluginMethod
    public void checkContactsPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("contacts", getPermissionState("contacts").toString());
        call.resolve(result);
    }

    @PluginMethod
    public void requestContactsPermission(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            checkContactsPermission(call);
            return;
        }
        requestPermissionForAlias("contacts", call, "contactsRequested");
    }

    @PermissionCallback
    private void contactsRequested(PluginCall call) {
        checkContactsPermission(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Abra as permissões nas configurações do Android.", error);
        }
    }
}