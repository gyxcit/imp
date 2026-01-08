import tensorflow as tf

print("TensorFlow version:", tf.__version__)
print("GPU disponibles:", tf.config.list_physical_devices('GPU'))

# Test simple
if tf.config.list_physical_devices('GPU'):
    print("✅ GPU détecté et prêt pour DeepFace")
    # Afficher les détails
    for gpu in tf.config.list_physical_devices('GPU'):
        details = tf.config.experimental.get_device_details(gpu)
        print(f"   GPU: {details}")
else:
    print("❌ Aucun GPU détecté - utilisation du CPU")